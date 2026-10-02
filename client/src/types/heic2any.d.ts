declare module "heic2any" {
  type ConversionResult = Blob | Blob[];

  interface ConversionOptions {
    blob: Blob;
    toType?: string;
    quality?: number;
  }

  function heic2any(options: ConversionOptions): Promise<ConversionResult>;
  export default heic2any;
}
