export function errorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.error?.message ||
    error?.message ||
    "Unable to update the access model. Please try again."
  );
}
