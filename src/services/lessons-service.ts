import {
  createLessonInputSchema,
  lessonOperationResultSchema,
  lessonSchema,
  updateLessonInputSchema,
  type Lesson,
  type LessonWarning
} from '@brouklins/class-manager-shared';
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../lib/auth';
import { hasOverlap, nowIso, subtractDays } from '../lib/dates';
import { conflictError, notFoundError } from '../lib/errors';
import { repository } from '../data/repository';
import { studentService } from './student-service';

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

    const lesson = lessonSchema.parse({
      entityType: 'lesson',
      lessonId: `les_${randomUUID()}`,
      teacherId: auth.teacherId,
      title: input.title,
      sport: input.sport,
      startAt: input.startAt,
      endAt: input.endAt,
      capacity: input.capacity,
      studentIds: input.studentIds,
      status: 'scheduled',
      notes: input.notes,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const candidates = await repository.listLessonsByRange(
      auth.teacherId,
      subtractDays(lesson.startAt, 1),
      lesson.endAt
    );

    const warnings = createWarnings(lesson, candidates.map((candidate) => lessonSchema.parse(candidate)));

    await repository.putLesson(lesson);

    return lessonOperationResultSchema.parse({
      lesson,
      warnings
    });
  },

  async updateLesson(auth: AuthContext, lessonId: string, payload: unknown) {
    const input = updateLessonInputSchema.parse(payload);
    const existing = await this.getLesson(auth, lessonId);
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
      warnings
    });
  },

  async cancelLesson(auth: AuthContext, lessonId: string): Promise<void> {
    const existing = await this.getLesson(auth, lessonId);
    const updated = lessonSchema.parse({
      ...existing,
      status: 'cancelled',
      updatedAt: nowIso()
    });

    await repository.putLesson(updated);
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

