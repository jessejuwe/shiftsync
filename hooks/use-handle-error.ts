export function useHandleError() {
  return {
    handleError: (error: Error) => {
      console.error("Error:", error);
    },
  };
}
