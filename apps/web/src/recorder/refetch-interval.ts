/** react-query refetchInterval while any file is processing. */
export function filesRefetchInterval(files: Array<{ status: string }>): number | false {
  return files.some((file) => file.status === "processing") ? 2000 : false;
}
