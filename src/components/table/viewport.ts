import { TABLE } from '../../engine/constants'

// Keep the placement surface aligned with the course camera and SVG fallback.
export const TABLE_VIEW = { width: 3.23, height: 1.9 }
export const TABLE_VIEW_BOX = `${(TABLE.length - TABLE_VIEW.width) / 2} ${(TABLE.width - TABLE_VIEW.height) / 2} ${TABLE_VIEW.width} ${TABLE_VIEW.height}`
export const FLAT_TABLE_VIEW_BOX = '-0.22 -0.24 2.98 1.75'
