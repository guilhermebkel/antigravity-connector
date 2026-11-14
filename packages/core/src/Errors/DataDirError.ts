export class DataDirError extends Error {
  constructor(directory: string) {
    super(`DATA_DIR ${directory} is not writable: create it or fix its permissions, then start the server again.`);
    this.name = "DataDirError";
  }
}
