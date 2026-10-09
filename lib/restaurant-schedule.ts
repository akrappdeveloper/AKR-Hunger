/**
 * Restaurant Schedule & Realtime Operating Status Utility
 * Handles weekly hours, daily breaks, special days closures, and manual overrides.
 */

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;   // 'HH:mm' in 24-hr format (e.g. '09:00')
  closeTime: string;  // 'HH:mm' in 24-hr format (e.g. '22:00')
  breakStart?: string; // Optional 'HH:mm'
  breakEnd?: string;   // Optional 'HH:mm'
}

export interface SpecialDay {
  date: string;       // 'YYYY-MM-DD'
  reason: string;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
}

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const DEFAULT_WEEKLY_SCHEDULE: Record<string, DaySchedule> = {
  Monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  Friday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
  Saturday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
  Sunday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
};

export interface OperatingStatus {
  isOpen: boolean;
  reason: string;
  nextOpenTime?: string;
  isManualClose?: boolean;
}

/**
 * Format 24-hour time "14:30" to 12-hour "2:30 PM"
 */
export function formatTime12Hr(time24?: string): string {
  if (!time24) return '';
  const [hoursStr, minutesStr] = time24.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || '0', 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12}:${formattedMinutes} ${ampm}`;
}

/**
 * Check whether a restaurant is operating right now based on:
 * 1. Manual override switch (isOpen / isCurrentlyOpen)
 * 2. Active status (isActive)
 * 3. Special day closures
 * 4. Weekly schedule hours & breaks
 */
export function checkRestaurantOperatingStatus(
  restaurant: any,
  currentDate = new Date()
): OperatingStatus {
  if (!restaurant) {
    return { isOpen: false, reason: 'Restaurant unavailable' };
  }

  // 1. Platform-level active toggle
  if (restaurant.isActive === false) {
    return { isOpen: false, reason: 'Restaurant is currently inactive on the platform' };
  }

  // 2. Manual toggle override (isOpen / isCurrentlyOpen)
  // If explicitly set to false by owner in settings/schedule, restaurant is immediately closed
  if (restaurant.isOpen === false || restaurant.isCurrentlyOpen === false) {
    return {
      isOpen: false,
      reason: 'Temporarily closed by restaurant',
      isManualClose: true,
    };
  }

  const schedule = restaurant.schedule as Record<string, DaySchedule> | undefined;

  // If no schedule configured, default to open since manual toggle is true
  if (!schedule) {
    return { isOpen: true, reason: 'Open now' };
  }

  // Current date parts
  const dayName = DAYS_OF_WEEK[currentDate.getDay()];
  const currentHours = currentDate.getHours();
  const currentMinutes = currentDate.getMinutes();
  const currentTime = `${currentHours < 10 ? '0' : ''}${currentHours}:${currentMinutes < 10 ? '0' : ''}${currentMinutes}`;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const day = currentDate.getDate();
  const currentDateStr = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;

  // 3. Special Days / Holiday Closures check
  const specialDays = restaurant.specialDays as SpecialDay[] | undefined;
  if (Array.isArray(specialDays) && specialDays.length > 0) {
    const specialToday = specialDays.find(sd => sd.date === currentDateStr);
    if (specialToday) {
      if (specialToday.isClosed) {
        return {
          isOpen: false,
          reason: specialToday.reason
            ? `Closed today for ${specialToday.reason}`
            : 'Closed today for special holiday',
        };
      } else if (specialToday.openTime && specialToday.closeTime) {
        // Special hours for today
        if (currentTime < specialToday.openTime || currentTime >= specialToday.closeTime) {
          return {
            isOpen: false,
            reason: `Special hours today: Opens at ${formatTime12Hr(specialToday.openTime)}`,
            nextOpenTime: formatTime12Hr(specialToday.openTime),
          };
        }
      }
    }
  }

  // 4. Weekly Schedule check for today
  const todaySchedule = schedule[dayName];
  if (!todaySchedule || todaySchedule.isOpen === false) {
    return {
      isOpen: false,
      reason: `Closed on ${dayName}s`,
    };
  }

  const { openTime, closeTime, breakStart, breakEnd } = todaySchedule;

  if (openTime && closeTime) {
    // Standard same-day window (e.g. 09:00 - 22:00)
    if (openTime <= closeTime) {
      if (currentTime < openTime) {
        return {
          isOpen: false,
          reason: `Opens today at ${formatTime12Hr(openTime)}`,
          nextOpenTime: formatTime12Hr(openTime),
        };
      }
      if (currentTime >= closeTime) {
        return {
          isOpen: false,
          reason: `Closed for today (closed at ${formatTime12Hr(closeTime)})`,
        };
      }
    } else {
      // Overnight schedule (e.g. 18:00 - 02:00 next day)
      const isInsideOvernight = currentTime >= openTime || currentTime < closeTime;
      if (!isInsideOvernight) {
        return {
          isOpen: false,
          reason: `Opens at ${formatTime12Hr(openTime)}`,
          nextOpenTime: formatTime12Hr(openTime),
        };
      }
    }
  }

  // 5. Daily Break check
  if (breakStart && breakEnd) {
    if (currentTime >= breakStart && currentTime < breakEnd) {
      return {
        isOpen: false,
        reason: `On kitchen break until ${formatTime12Hr(breakEnd)}`,
        nextOpenTime: formatTime12Hr(breakEnd),
      };
    }
  }

  return { isOpen: true, reason: 'Open now' };
}
