import { describe, expect, it, vi } from 'vitest';

import { dashboardService } from '../src/services/dashboard-service';
import { repository } from '../src/data/repository';

vi.mock('../src/data/repository', () => ({
  repository: {
    listStudents: vi.fn(),
    listLessonsByRange: vi.fn(),
    listAllLessons: vi.fn()
  }
}));

describe('dashboard service', () => {
  it('computes dashboard summary data', async () => {
    vi.mocked(repository.listStudents).mockResolvedValue([
      {
        entityType: 'student',
        teacherId: 'teacher_123',
        studentId: 'stu_1',
        name: 'Maria',
        status: 'active',
        startedAt: '2026-05-01T00:00:00.000Z',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z'
      }
    ]);

    vi.mocked(repository.listLessonsByRange).mockResolvedValue([
      {
        entityType: 'lesson',
        teacherId: 'teacher_123',
        lessonId: 'les_1',
        title: 'Aula',
        sport: 'beach_tennis',
        startAt: '2026-06-03T10:00:00.000Z',
        endAt: '2026-06-03T11:00:00.000Z',
        capacity: 4,
        studentIds: ['stu_1'],
        status: 'scheduled',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);

    vi.mocked(repository.listAllLessons).mockResolvedValue([
      {
        entityType: 'lesson',
        teacherId: 'teacher_123',
        lessonId: 'les_1',
        title: 'Aula',
        sport: 'beach_tennis',
        startAt: '2099-06-03T10:00:00.000Z',
        endAt: '2099-06-03T11:00:00.000Z',
        capacity: 4,
        studentIds: ['stu_1'],
        status: 'scheduled',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z'
      }
    ]);

    const result = await dashboardService.getSummary({ teacherId: 'teacher_123' });

    expect(result.activeStudents).toBe(1);
    expect(result.occupancyRate).toBe(0.25);
    expect(result.upcomingLessons).toBe(1);
  });
});

