/** The model ignored the flat key-colour background, so no cut-out can be made; worth another try. */
export class TransparentCutoutError extends Error {}

/** The model reframed the photo too much to put the edit back on the original; worth another try. */
export class UnalignedEditError extends Error {}
