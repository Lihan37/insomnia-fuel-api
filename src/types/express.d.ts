  import "express";
  import { DecodedIdToken } from "firebase-admin/auth";

  declare module "express-serve-static-core" {
    interface Request {
      /**
       * Firebase decoded ID token (attached by authGuard)
       */
      user?: DecodedIdToken & {
        admin?: boolean; // custom claim or derived flag
        role?: "admin" | "user"; // optional role system
      };
    }
  }
