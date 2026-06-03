import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import type { TeacherProfile, Student, Lesson } from '@brouklins/class-manager-shared';

import { dynamo } from '../lib/dynamo';
import { env } from '../lib/env';

type DbItem = Record<string, unknown>;

const teacherPk = (teacherId: string) => `TEACHER#${teacherId}`;
const studentSk = (studentId: string) => `STUDENT#${studentId}`;
const lessonSk = (lessonId: string) => `LESSON#${lessonId}`;

export const repository = {
  async getTeacherProfile(teacherId: string): Promise<TeacherProfile | undefined> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.tableName,
        Key: {
          PK: teacherPk(teacherId),
          SK: 'PROFILE'
        }
      })
    );

    return result.Item as TeacherProfile | undefined;
  },

  async putTeacherProfile(profile: TeacherProfile): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.tableName,
        Item: {
          PK: teacherPk(profile.teacherId),
          SK: 'PROFILE',
          ...profile
        }
      })
    );
  },

  async listStudents(teacherId: string): Promise<Student[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: env.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': teacherPk(teacherId),
          ':skPrefix': 'STUDENT#'
        }
      })
    );

    return (result.Items ?? []) as Student[];
  },

  async getStudent(teacherId: string, studentId: string): Promise<Student | undefined> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.tableName,
        Key: {
          PK: teacherPk(teacherId),
          SK: studentSk(studentId)
        }
      })
    );

    return result.Item as Student | undefined;
  },

  async putStudent(student: Student): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.tableName,
        Item: {
          PK: teacherPk(student.teacherId),
          SK: studentSk(student.studentId),
          GSI1PK: `${teacherPk(student.teacherId)}#STUDENTS`,
          GSI1SK: `NAME#${student.name.toLowerCase()}#STUDENT#${student.studentId}`,
          ...student
        }
      })
    );
  },

  async listLessonsByRange(teacherId: string, from: string, to: string): Promise<Lesson[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: env.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':gsi1pk': `${teacherPk(teacherId)}#LESSONS`,
          ':from': `START#${from}`,
          ':to': `START#${to}#~`
        }
      })
    );

    return (result.Items ?? []) as Lesson[];
  },

  async listAllLessons(teacherId: string): Promise<Lesson[]> {
    return this.listLessonsByRange(teacherId, '0000-01-01T00:00:00.000Z', '9999-12-31T23:59:59.999Z');
  },

  async getLesson(teacherId: string, lessonId: string): Promise<Lesson | undefined> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: env.tableName,
        Key: {
          PK: teacherPk(teacherId),
          SK: lessonSk(lessonId)
        }
      })
    );

    return result.Item as Lesson | undefined;
  },

  async putLesson(lesson: Lesson): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: env.tableName,
        Item: {
          PK: teacherPk(lesson.teacherId),
          SK: lessonSk(lesson.lessonId),
          GSI1PK: `${teacherPk(lesson.teacherId)}#LESSONS`,
          GSI1SK: `START#${lesson.startAt}#LESSON#${lesson.lessonId}`,
          ...lesson
        }
      })
    );
  },

  async deleteLesson(teacherId: string, lessonId: string): Promise<void> {
    await dynamo.send(
      new DeleteCommand({
        TableName: env.tableName,
        Key: {
          PK: teacherPk(teacherId),
          SK: lessonSk(lessonId)
        }
      })
    );
  },

  async rawUpdate(
    key: { PK: string; SK: string },
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<DbItem | undefined> {
    const result = await dynamo.send(
      new UpdateCommand({
        TableName: env.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
      })
    );

    return result.Attributes;
  }
};

export const keys = {
  teacherPk,
  studentSk,
  lessonSk
};
