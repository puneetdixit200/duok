import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCurrentReminderNotificationPermission,
  getNextReminderDate,
  requestReminderNotificationPermission,
  showDailyReminderNotification,
} from './reminders'

describe('reminder notifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('schedules the next daily reminder from a 12-hour time label', () => {
    const sameDay = getNextReminderDate('8:30 PM', new Date('2026-05-27T20:00:00'))
    const nextDay = getNextReminderDate('8:30 PM', new Date('2026-05-27T20:45:00'))

    expect(sameDay.getDate()).toBe(27)
    expect(sameDay.getHours()).toBe(20)
    expect(sameDay.getMinutes()).toBe(30)
    expect(nextDay.getDate()).toBe(28)
    expect(nextDay.getHours()).toBe(20)
    expect(nextDay.getMinutes()).toBe(30)
  })

  it('requests and reads desktop notification permission', async () => {
    let permission: NotificationPermission = 'default'
    const NotificationMock = vi.fn()
    Object.defineProperty(NotificationMock, 'permission', {
      get: () => permission,
    })
    Object.assign(NotificationMock, {
      requestPermission: vi.fn(async () => {
        permission = 'granted'
        return permission
      }),
    })
    vi.stubGlobal('Notification', NotificationMock)

    expect(getCurrentReminderNotificationPermission()).toBe('default')
    await expect(requestReminderNotificationPermission()).resolves.toBe('granted')
    expect(NotificationMock.requestPermission).toHaveBeenCalledOnce()
    expect(getCurrentReminderNotificationPermission()).toBe('granted')
  })

  it('shows a daily reminder when notifications are allowed', () => {
    const NotificationMock = vi.fn()
    Object.defineProperty(NotificationMock, 'permission', {
      get: () => 'granted',
    })
    vi.stubGlobal('Notification', NotificationMock)

    expect(showDailyReminderNotification('7:30 PM')).toBe(true)
    expect(NotificationMock).toHaveBeenCalledWith('KannadaOS daily reminder', expect.objectContaining({
      body: expect.stringContaining('7:30 PM'),
      tag: 'kannadaos-daily-reminder',
    }))
  })
})
