/**
 * Save and download file with the given data.
 * @param data String data to save in the file.
 * @param fileName Name of the downloaded file.
 * @param contentType Content type of the file.
 */
export declare const saveFile: (data: string, fileName: string, contentType?: string) => void;
/**
 * Load a file from user by mocking an input element.
 * @param onFileRead Callback when the file is read.
 * @param contentType Content type of the file. Default 'application/json'.
 */
export declare const loadFile: (onFileRead: (data: string) => void, contentType?: string) => void;
