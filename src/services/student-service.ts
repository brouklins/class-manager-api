import {
  createStudentInputSchema,
  studentSchema,
  updateStudentInputSchema,
  type Student
} from '@brouklins/class-manager-shared';
import { randomUUID } from 'node:crypto';

import type { AuthContext } from '../lib/auth';
import { nowIso, normalizeName } from '../lib/dates';
import { notFoundError } from '../lib/errors';
import { repository } from '../data/repository';

const matchesSearch = (student: Student, search?: string): boolean => {
  if (!search) {
    return true;
  }

  const normalizedSearch = normalizeName(search);
  return [student.name, student.email ?? '', student.phone ?? '']
    .map(normalizeName)
    .some((value) => value.includes(normalizedSearch));
};

const hydrateStudent = (student: Record<string, unknown>): Student =>
  studentSchema.parse({
    ...student,
    lastPaymentAt:
      (typeof student.lastPaymentAt === 'string' && student.lastPaymentAt) ||
      (typeof student.startedAt === 'string' && student.startedAt) ||
      (typeof student.createdAt === 'string' && student.createdAt) ||
      nowIso()
  });

export const studentService = {
  async listStudents(auth: AuthContext, status = 'active', search?: string): Promise<Student[]> {
    const students = await repository.listStudents(auth.teacherId);

    return students
      .map((student) => hydrateStudent(student as Record<string, unknown>))
      .filter((student) => (status === 'all' ? true : student.status === status))
      .filter((student) => matchesSearch(student, search))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  },

  async getStudent(auth: AuthContext, studentId: string): Promise<Student> {
    const student = await repository.getStudent(auth.teacherId, studentId);

    if (!student) {
      throw notFoundError('Student not found.');
    }

    return hydrateStudent(student as Record<string, unknown>);
  },

  async createStudent(auth: AuthContext, payload: unknown): Promise<Student> {
    const input = createStudentInputSchema.parse(payload);
    const timestamp = nowIso();

    const student = studentSchema.parse({
      entityType: 'student',
      studentId: `stu_${randomUUID()}`,
      teacherId: auth.teacherId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      status: 'active',
      startedAt: input.startedAt ?? timestamp,
      lastPaymentAt: input.lastPaymentAt ?? input.startedAt ?? timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await repository.putStudent(student);
    return student;
  },

  async updateStudent(auth: AuthContext, studentId: string, payload: unknown): Promise<Student> {
    const input = updateStudentInputSchema.parse(payload);
    const existing = await this.getStudent(auth, studentId);

    const updated = studentSchema.parse({
      ...existing,
      ...input,
      updatedAt: nowIso()
    });

    await repository.putStudent(updated);
    return updated;
  },

  async deleteStudent(auth: AuthContext, studentId: string): Promise<void> {
    const existing = await this.getStudent(auth, studentId);

    const updated = studentSchema.parse({
      ...existing,
      status: 'inactive',
      deletedAt: nowIso(),
      updatedAt: nowIso()
    });

    await repository.putStudent(updated);
  }
};
