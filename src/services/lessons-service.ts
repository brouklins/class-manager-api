import {
  type CreateLessonInput,
  createLessonInputSchema,
  lessonOperationResultSchema,
  lessonSchema,
  updateLessonInputSchema,
  type Lesson,
  type LessonOperationResult,
  type LessonWarning
} from '@brouklins/class-manager-shared';
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../lib/auth';
import { hasOverlap, nowIso, subtractDays } from '../lib/dates';
import { conflictError, notFoundError } from '../lib/errors';
import { repository } from '../data/repository';
import { studentService } from './student-service';

type LessonUpdateScope = 'single' | 'series';

const sortByStart = (left: Lesson, right: Lesson) =>
  new Date(left.startAt).getTime() - new Date(right.startAt).getTime();

const createWarnings = (lesson: Lesson, candidates: Lesson[]): LessonWarning[] => {
  const conflictingLessonIds = candidates
    .filter(
      (candidate) =>
        candidate.lessonId !== lesson.lessonId &&
        candidate.status !== 'cancelled' &&
        hasOverlap(lesson.startAt, lesson.endAt, candidate.startAt, candidate.endAt)
    )
    .map((candidate) => candidate.lessonId);

  if (conflictingLessonIds.length === 0) {
    return [];
  }

  return [
    {
      code: 'schedule_overlap',
      message: 'Existe sobreposição com outra aula agendada.',
      conflictingLessonIds
    }
  ];
};

const buildRecurringLessons = (
  teacherId: string,
  timestamp: string,
  baseLessonId: string,
  input: CreateLessonInput
): Lesson[] => {
  const seriesId = input.recurrence ? `series_${randomUUID()}` : undefined;
  const startTime = new Date(input.startAt).getTime();
  const endTime = new Date(input.endAt).getTime();
  const lessonDuration = endTime - startTime;
  const recurrenceEnd = input.recurrence ? new Date(input.recurrence.until).getTime() : startTime;
  const lessons: Lesson[] = [];

  for (let occurrenceStart = startTime, index = 0; occurrenceStart <= recurrenceEnd; occurrenceStart += 7 * 24 * 60 * 60 * 1000, index += 1) {
    const lessonId = index === 0 ? baseLessonId : `les_${randomUUID()}`;

    lessons.push(
      lessonSchema.parse({
        entityType: 'lesson',
        lessonId,
        recurringSeriesId: seriesId,
        teacherId,
        title: input.title,
        sport: input.sport,
        startAt: new Date(occurrenceStart).toISOString(),
        endAt: new Date(occurrenceStart + lessonDuration).toISOString(),
        capacity: input.capacity,
        studentIds: input.studentIds,
        status: 'scheduled',
        notes: input.notes,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    );
  }

  if (lessons.length > 104) {
    throw conflictError('A recorrencia semanal excede o limite de 104 aulas.');
  }

  return lessons;
};

const mergeWarnings = (warnings: LessonWarning[]): LessonWarning[] => {
  const overlaps = warnings.filter((warning) => warning.code === 'schedule_overlap');

  if (overlaps.length === 0) {
    return [];
  }

  const conflictingLessonIds = [...new Set(overlaps.flatMap((warning) => warning.conflictingLessonIds))];

  return [
    {
      code: 'schedule_overlap',
      message: 'Existe sobreposição com outra aula agendada.',
      conflictingLessonIds
    }
  ];
};

const listSeriesLessons = async (auth: AuthContext, lesson: Lesson): Promise<Lesson[]> => {
  if (!lesson.recurringSeriesId) {
    return [lesson];
  }

  const allLessons = await repository.listAllLessons(auth.teacherId);

  return allLessons
    .map((item) => lessonSchema.parse(item))
    .filter((candidate) => candidate.recurringSeriesId === lesson.recurringSeriesId)
    .sort(sortByStart);
};

const buildSeriesUpdate = (
  seriesLessons: Lesson[],
  referenceLesson: Lesson,
  input: ReturnType<typeof updateLessonInputSchema.parse>,
  timestamp: string
): Lesson[] => {
  const startDelta =
    input.startAt !== undefined
      ? new Date(input.startAt).getTime() - new Date(referenceLesson.startAt).getTime()
      : 0;
  const endDelta =
    input.endAt !== undefined
      ? new Date(input.endAt).getTime() - new Date(referenceLesson.endAt).getTime()
      : 0;

  return seriesLessons.map((lesson) =>
    lessonSchema.parse({
      ...lesson,
      ...input,
      startAt:
        input.startAt !== undefined
          ? new Date(new Date(lesson.startAt).getTime() + startDelta).toISOString()
          : lesson.startAt,
      endAt:
        input.endAt !== undefined
          ? new Date(new Date(lesson.endAt).getTime() + endDelta).toISOString()
          : lesson.endAt,
      updatedAt: timestamp
    })
  );
};

const ensureStudentsExistAndAreActive = async (auth: AuthContext, studentIds: string[]) => {
  await Promise.all(
    studentIds.map(async (studentId) => {
      const student = await studentService.getStudent(auth, studentId);

      if (student.status !== 'active') {
        throw conflictError(`Student ${studentId} is inactive.`);
      }
    })
  );
};

export const lessonsService = {
  async listLessons(auth: AuthContext, from: string, to: string): Promise<Lesson[]> {
    const items = await repository.listLessonsByRange(auth.teacherId, from, to);
    return items.map((item) => lessonSchema.parse(item)).sort(sortByStart);
  },

  async getLesson(auth: AuthContext, lessonId: string): Promise<Lesson> {
    const item = await repository.getLesson(auth.teacherId, lessonId);

    if (!item) {
      throw notFoundError('Lesson not found.');
    }

    return lessonSchema.parse(item);
  },

  async createLesson(auth: AuthContext, payload: unknown) {
    const input = createLessonInputSchema.parse(payload);
    const timestamp = nowIso();

    await ensureStudentsExistAndAreActive(auth, input.studentIds);
    const lessons = buildRecurringLessons(auth.teacherId, timestamp, `les_${randomUUID()}`, input);
    const rangeEnd = lessons.at(-1)?.endAt ?? input.endAt;
    const existingCandidates = await repository.listLessonsByRange(
      auth.teacherId,
      subtractDays(lessons[0]!.startAt, 1),
      rangeEnd
    );
    const parsedCandidates = existingCandidates.map((candidate) => lessonSchema.parse(candidate));
    const warnings = mergeWarnings(lessons.flatMap((lesson) => createWarnings(lesson, parsedCandidates)));

    await Promise.all(lessons.map(async (lesson) => repository.putLesson(lesson)));

    return lessonOperationResultSchema.parse({
      lesson: lessons[0]!,
      affectedLessons: lessons,
      warnings
    });
  },

  async updateLesson(
    auth: AuthContext,
    lessonId: string,
    payload: unknown,
    scope: LessonUpdateScope = 'single'
  ): Promise<LessonOperationResult> {
    const input = updateLessonInputSchema.parse(payload);
    const existing = await this.getLesson(auth, lessonId);

    if (input.studentIds) {
      await ensureStudentsExistAndAreActive(auth, input.studentIds);
    }

    if (scope === 'series' && existing.recurringSeriesId) {
      const timestamp = nowIso();
      const seriesLessons = await listSeriesLessons(auth, existing);
      const updatedSeries = buildSeriesUpdate(seriesLessons, existing, input, timestamp);
      const updatedIds = new Set(updatedSeries.map((lesson) => lesson.lessonId));
      const candidates = (await repository.listAllLessons(auth.teacherId))
        .map((candidate) => lessonSchema.parse(candidate))
        .filter((candidate) => !updatedIds.has(candidate.lessonId));
      const warnings = mergeWarnings(updatedSeries.flatMap((lesson) => createWarnings(lesson, candidates)));

      await Promise.all(updatedSeries.map(async (lesson) => repository.putLesson(lesson)));

      return lessonOperationResultSchema.parse({
        lesson: updatedSeries.find((lesson) => lesson.lessonId === lessonId) ?? updatedSeries[0],
        affectedLessons: updatedSeries,
        warnings
      });
    }

    const updated = lessonSchema.parse({
      ...existing,
      ...input,
      updatedAt: nowIso()
    });

    if (updated.studentIds.length > updated.capacity) {
      throw conflictError('Lesson capacity cannot be lower than current enrollment.');
    }

    const candidates = await repository.listLessonsByRange(
      auth.teacherId,
      subtractDays(updated.startAt, 1),
      updated.endAt
    );

    const warnings = createWarnings(updated, candidates.map((candidate) => lessonSchema.parse(candidate)));

    await repository.putLesson(updated);

    return lessonOperationResultSchema.parse({
      lesson: updated,
      affectedLessons: [updated],
      warnings
    });
  },

  async cancelLesson(auth: AuthContext, lessonId: string, scope: LessonUpdateScope = 'single'): Promise<void> {
    const existing = await this.getLesson(auth, lessonId);

    if (scope === 'series' && existing.recurringSeriesId) {
      const timestamp = nowIso();
      const seriesLessons = await listSeriesLessons(auth, existing);

      await Promise.all(
        seriesLessons.map(async (lesson) =>
          repository.putLesson(
            lessonSchema.parse({
              ...lesson,
              status: 'cancelled',
              updatedAt: timestamp
            })
          )
        )
      );
      return;
    }

    const updated = lessonSchema.parse({
      ...existing,
      status: 'cancelled',
      updatedAt: nowIso()
    });

    await repository.putLesson(updated);
  },

  async deleteLesson(auth: AuthContext, lessonId: string, scope: LessonUpdateScope = 'single'): Promise<void> {
    const existing = await this.getLesson(auth, lessonId);

    if (scope === 'series' && existing.recurringSeriesId) {
      const seriesLessons = await listSeriesLessons(auth, existing);

      await Promise.all(
        seriesLessons.map(async (lesson) => repository.deleteLesson(auth.teacherId, lesson.lessonId))
      );
      return;
    }

    await repository.deleteLesson(auth.teacherId, lessonId);
  },

  async addStudent(auth: AuthContext, lessonId: string, studentId: string) {
    const [lesson, student] = await Promise.all([
      this.getLesson(auth, lessonId),
      studentService.getStudent(auth, studentId)
    ]);

    if (student.status !== 'active') {
      throw conflictError('Only active students can be added to lessons.');
    }

    if (lesson.studentIds.includes(studentId)) {
      throw conflictError('Student is already enrolled in this lesson.');
    }

    if (lesson.studentIds.length >= lesson.capacity) {
      throw conflictError('Lesson capacity exceeded.');
    }

    const updated = lessonSchema.parse({
      ...lesson,
      studentIds: [...lesson.studentIds, studentId],
      updatedAt: nowIso()
    });

    const candidates = await repository.listLessonsByRange(
      auth.teacherId,
      subtractDays(updated.startAt, 1),
      updated.endAt
    );

    const warnings = createWarnings(updated, candidates.map((candidate) => lessonSchema.parse(candidate)));

    await repository.putLesson(updated);

    return lessonOperationResultSchema.parse({
      lesson: updated,
      affectedLessons: [updated],
      warnings
    });
  },

  async removeStudent(auth: AuthContext, lessonId: string, studentId: string): Promise<void> {
    const lesson = await this.getLesson(auth, lessonId);

    if (!lesson.studentIds.includes(studentId)) {
      return;
    }

    const updated = lessonSchema.parse({
      ...lesson,
      studentIds: lesson.studentIds.filter((currentId) => currentId !== studentId),
      updatedAt: nowIso()
    });

    await repository.putLesson(updated);
  }
};
