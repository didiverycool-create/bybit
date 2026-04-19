export type AppWorkspaceBaseArgsEnvelope<T> = {
  baseArgs: T
}

export function buildAppWorkspaceBaseArgs<T>(baseArgs: T): AppWorkspaceBaseArgsEnvelope<T> {
  return {
    baseArgs,
  }
}
