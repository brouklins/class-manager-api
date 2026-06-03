import { dashboardSummarySchema, type Lesson, type Student } from '@brouklins/class-manager-shared';

import type { AuthContext } from '../lib/auth';
import {
  endOfCurrentMonthUtc,
  relationshipDays,
  startOfCurrentMonthUtc
} from '../lib/dates';
import { repository } from '../data/repository';

const isScheduledOrCompleted = (lesson: Lesson) => lesson.status === 'scheduled' || lesson.status === 'completed';

export const dashboardService = {
  async getSummary(auth: AuthContext, from?: string, to?: string) {
    const rangeFrom = from ?? startOfCurrentMonthUtc();
    const rangeTo = to ?? endOfCurrentMonthUtc();

    const [students, rangeLessons, allLessons] = await Promise.all([
      repository.listStudents(auth.teacherId),
      repository.listLessonsByRange(auth.teacherId, rangeFrom, rangeTo),
      repository.listAllLessons(auth.teacherId)
    ]);

    const parsedStudents = students as Student[];
    const parsedRangeLessons = (rangeLessons as Lesson[]).filter(isScheduledOrCompleted);
    const parsedAllLessons = allLessons as Lesson[];
    const activeStudents = parsedStudents.filter((student) => student.status === 'active');
    const now = new Date();

    const upcomingLessons = parsedAllLessons.filter(
      (lesson) => lesson.status === 'scheduled' && new Date(lesson.startAt).getTime() >= now.getTime()
    );

    const totalCapacity = parsedRangeLessons.reduce((total, lesson) => total + lesson.capacity, 0);
    const totalEnrollment = parsedRangeLessons.reduce((total, lesson) => total + lesson.studentIds.length, 0);

    const averageStudentRelationshipDays =
      activeStudents.length === 0
        ? 0
        : activeStudents.reduce((total, student) => total + relationshipDays(student.startedAt, now), 0) /
          activeStudents.length;

    return dashboardSummarySchema.parse({
      activeStudents: activeStudents.length,
      totalStudents: parsedStudents.length,
      lessonsThisMonth: parsedRangeLessons.length,
      upcomingLessons: upcomingLessons.length,
      averageStudentRelationshipDays,
      occupancyRate: totalCapacity === 0 ? 0 : totalEnrollment / totalCapacity,
      oldestStudents: [...activeStudents]
        .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
        .slice(0, 5)
        .map((student) => ({
          studentId: student.studentId,
          name: student.name,
          relationshipDays: relationshipDays(student.startedAt, now)
        }))
    });
  }
};

