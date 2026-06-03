import {
  FREE_TRIAL_DAYS,
  SUPPORT_WHATSAPP_DISPLAY,
  teacherProfileSchema,
  updateTeacherProfileInputSchema,
  type TeacherProfile
} from '@brouklins/class-manager-shared';

import type { AuthContext } from '../lib/auth';
import { addDays, isFutureOrNow, nowIso } from '../lib/dates';
import { repository } from '../data/repository';

const trialEndsAtFrom = (createdAt: string) => addDays(createdAt, FREE_TRIAL_DAYS);

const withAccessWindow = (profile: TeacherProfile): TeacherProfile => {
  const trialEndsAt = profile.trialEndsAt ?? trialEndsAtFrom(profile.createdAt);
  const accessStatus =
    profile.accessEndsAt && isFutureOrNow(profile.accessEndsAt)
      ? 'active'
      : isFutureOrNow(trialEndsAt)
        ? 'trialing'
        : 'expired';

  return teacherProfileSchema.parse({
    ...profile,
    accessStatus,
    trialStartedAt: profile.trialStartedAt ?? profile.createdAt,
    trialEndsAt
  });
};

const buildDefaultProfile = (auth: AuthContext): TeacherProfile => {
  const timestamp = nowIso();

  return withAccessWindow(
    teacherProfileSchema.parse({
      entityType: 'teacher_profile',
      teacherId: auth.teacherId,
      displayName: auth.displayName ?? auth.email?.split('@')[0] ?? 'Professor',
      email: auth.email,
      timezone: 'America/Sao_Paulo',
      preferredCalendarView: 'timeGridWeek',
      accessStatus: 'trialing',
      trialStartedAt: timestamp,
      trialEndsAt: trialEndsAtFrom(timestamp),
      createdAt: timestamp,
      updatedAt: timestamp
    })
  );
};

export const profileService = {
  getTrialCopy() {
    return {
      freeTrialDays: FREE_TRIAL_DAYS,
      supportWhatsApp: SUPPORT_WHATSAPP_DISPLAY
    };
  },

  async getProfile(auth: AuthContext): Promise<TeacherProfile> {
    const existing = await repository.getTeacherProfile(auth.teacherId);

    if (existing) {
      const hydrated = withAccessWindow(teacherProfileSchema.parse(existing));

      if (
        hydrated.accessStatus !== existing.accessStatus ||
        hydrated.trialEndsAt !== existing.trialEndsAt ||
        hydrated.trialStartedAt !== existing.trialStartedAt
      ) {
        await repository.putTeacherProfile(hydrated);
      }

      return hydrated;
    }

    const profile = buildDefaultProfile(auth);
    await repository.putTeacherProfile(profile);
    return profile;
  },

  async updateProfile(auth: AuthContext, payload: unknown): Promise<TeacherProfile> {
    const input = updateTeacherProfileInputSchema.parse(payload);
    const existing = await this.getProfile(auth);

    const updated = withAccessWindow(
      teacherProfileSchema.parse({
        ...existing,
        ...input,
        updatedAt: nowIso()
      })
    );

    await repository.putTeacherProfile(updated);
    return updated;
  }
};
