/** Locked 証明写真 print size: 30×40mm at 300dpi (mvp-plan / WN-46). */
export const PHOTO_PRINT_WIDTH_MM = 30;
export const PHOTO_PRINT_HEIGHT_MM = 40;
export const PHOTO_PRINT_DPI = 300;

export const PHOTO_PRINT_WIDTH_PX = Math.round(
  (PHOTO_PRINT_WIDTH_MM / 25.4) * PHOTO_PRINT_DPI,
);
export const PHOTO_PRINT_HEIGHT_PX = Math.round(
  (PHOTO_PRINT_HEIGHT_MM / 25.4) * PHOTO_PRINT_DPI,
);

/** Display size in CSS/docx pixels (~96dpi) for a 30×40mm frame. */
export const PHOTO_DISPLAY_WIDTH_PX = Math.round(
  (PHOTO_PRINT_WIDTH_MM / 25.4) * 96,
);
export const PHOTO_DISPLAY_HEIGHT_PX = Math.round(
  (PHOTO_PRINT_HEIGHT_MM / 25.4) * 96,
);

export const PHOTO_ASPECT_RATIO = PHOTO_PRINT_WIDTH_MM / PHOTO_PRINT_HEIGHT_MM;
