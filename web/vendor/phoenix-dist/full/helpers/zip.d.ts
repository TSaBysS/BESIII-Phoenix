/**
 * Read a zip file and return its contents as an object.
 * @param file The file or array buffer to be read.
 * @returns An object with file paths in zip as keys and the files'
 * string contents as values.
 */
export declare const readZipFile: (file: File | ArrayBuffer) => Promise<{
    [fileName: string]: string;
}>;
