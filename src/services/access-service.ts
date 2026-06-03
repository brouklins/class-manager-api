import {
  FREE_TRIAL_DAYS,
  MONTHLY_PRICE_CENTS,
  SUPPORT_WHATSAPP_DISPLAY
} from '@brouklins/class-manager-shared';

import type { AuthContext } from '../lib/auth';
import { accessExpiredError } from '../lib/errors';
import { profileService } from './profile-service';

export const accessService = {
  async requireActiveAccess(auth: AuthContext) {
    const profile = await profileService.getProfile(auth);

    if (profile.accessStatus === 'expired') {
      throw accessExpiredError(
        `Seu trial de ${FREE_TRIAL_DAYS} dias terminou. Para reativar por R$ ${(MONTHLY_PRICE_CENTS / 100).toFixed(0)}/30 dias, fale no WhatsApp ${SUPPORT_WHATSAPP_DISPLAY}.`,
        [
          {
            accessStatus: profile.accessStatus,
            trialEndsAt: profile.trialEndsAt,
            accessEndsAt: profile.accessEndsAt
          }
        ]
      );
    }

    return profile;
  }
};
