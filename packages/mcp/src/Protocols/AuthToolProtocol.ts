import type { AuthCodeRequest, AuthStatusResponse } from "@antigravity-connector/protocol";

export type CheckAuthInput = { readonly noArguments?: never };

export type SetAuthInput = AuthCodeRequest;

export type AuthToolOutput = AuthStatusResponse;
