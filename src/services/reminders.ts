export type ReminderPermission = 'default' | 'granted' | 'denied'

const fallbackReminderTime = '7:30 PM'

export async function requestReminderNotificationPermission(): Promise<ReminderPermission> {
  if (!hasNotificationApi() || typeof Notification.requestPermission !== 'function') {
    return 'denied'
  }

  return normalizeReminderPermission(await Notification.requestPermission())
}

export function getCurrentReminderNotificationPermission(): ReminderPermission {
  if (!hasNotificationApi()) {
    return 'default'
  }

  return normalizeReminderPermission(Notification.permission)
}

export function getNextReminderDate(time: string, now = new Date()): Date {
  const parsed = parseReminderTime(time) ?? parseReminderTime(fallbackReminderTime)!
  const next = new Date(now)
  next.setHours(parsed.hour, parsed.minute, 0, 0)

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }

  return next
}

export function formatReminderSchedule(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function showDailyReminderNotification(time: string): boolean {
  if (!hasNotificationApi() || Notification.permission !== 'granted') {
    return false
  }

  new Notification('KannadaOS daily reminder', {
    body: `Practice Kannada today. Your reminder is set for ${time}.`,
    tag: 'kannadaos-daily-reminder',
  })

  return true
}

function hasNotificationApi(): boolean {
  return typeof Notification !== 'undefined'
}

function normalizeReminderPermission(permission: NotificationPermission): ReminderPermission {
  return permission === 'granted' || permission === 'denied' ? permission : 'default'
}

function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(time.trim())
  if (!match) {
    return null
  }

  const rawHour = Number(match[1])
  const minute = Number(match[2])
  if (rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) {
    return null
  }

  const period = match[3].toUpperCase()
  const hour = period === 'AM'
    ? rawHour % 12
    : (rawHour % 12) + 12

  return { hour, minute }
}
