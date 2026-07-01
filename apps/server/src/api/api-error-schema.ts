import { t } from "elysia";

export const apiErrorResponseSchema = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    fieldErrors: t.Optional(
      t.Array(
        t.Object({
          field: t.String(),
          code: t.String(),
          message: t.String(),
        }),
      ),
    ),
  }),
});
