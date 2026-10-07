/**
 * @typedef {Object} RecurrenceRule
 * @property {'daily'|'weekly'|'everyN'|'monthly'} freq
 * @property {number} interval - every N days/weeks/months (default 1)
 * @property {number[]|null} byWeekday - 0=Sun..6=Sat, used when freq='weekly'
 * @property {string} startDate - 'YYYY-MM-DD'
 * @property {string|null} endDate - 'YYYY-MM-DD' or null for no end
 * @property {string|null} time - 'HH:mm' or null for all-day occurrences
 */

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} title
 * @property {number|null} durationMinutes - multiple of 10, or null = reminder
 * @property {string} notes
 * @property {string|null} categoryId
 * @property {number} percentComplete - 0-100
 * @property {string|null} group - backlog group name; a group exists only while some item carries its name, so it syncs with the item
 * @property {string[]} parentIds
 * @property {string[]} childIds
 * @property {RecurrenceRule|null} recurrence
 * @property {boolean} isUnscheduled
 * @property {boolean} isAllDay
 * @property {boolean} isHabit - recurring items only; tracked on the Stats page
 * @property {boolean} archived
 * @property {number} order - manual backlog sort position, lower sorts first
 * @property {boolean} syncEnabled - whether this item (and its instances) sync to the encrypted cloud store
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ScheduledInstance
 * @property {string} id
 * @property {string} itemId
 * @property {string} date - 'YYYY-MM-DD'
 * @property {string|null} time - 'HH:mm' or null for all-day
 * @property {number|null} durationMinutes
 * @property {boolean} isAllDay
 * @property {string} notes - independent per occurrence, seeded from the item's notes when created
 * @property {number} percentComplete - 0-100, independent per occurrence
 * @property {number|null} startPercent
 * @property {'pending'|'completed'|'worked_on'|'ghost'} status
 * @property {boolean} finalized
 * @property {number|null} finalPercent
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} DayJournal
 * @property {string} date - primary key, 'YYYY-MM-DD'
 * @property {string} content - HTML string
 * @property {string|null} mood - an emoji, or null if not set
 * @property {string|null} spouseMood - spouse's mood emoji, or null if not set
 * @property {number|null} screenTimeMinutes - total screen time for the day in minutes, or null if not logged
 * @property {string} updatedAt
 */

export {}
