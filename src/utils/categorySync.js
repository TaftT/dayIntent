/** Categories saved before the synced/local split have no flag; they were synced, so they still are. */
export const isCategorySynced = (category) => category?.syncEnabled !== false
