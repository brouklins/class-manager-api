import { nonEmptyTrimmedStringSchema } from '@brouklins/class-manager-shared';

const envSchema = nonEmptyTrimmedStringSchema;

export const env = {
  appEnv: process.env.APP_ENV ?? 'local',
  tableName: envSchema.parse(process.env.TABLE_NAME ?? 'ClassManagerTable')
};

