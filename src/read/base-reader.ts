import { DecibelReaderDeps } from "../constants";
import {
  FetchOptions,
  getRequest as baseGetRequest,
  GetRequestArgs,
  patchRequest as basePatchRequest,
  PatchRequestArgs,
  postRequest as basePostRequest,
  PostRequestArgs,
} from "../utils";

export interface BaseRequestArgs {
  fetchOptions?: FetchOptions;
}

export class BaseReader {
  constructor(protected readonly deps: DecibelReaderDeps) {}

  private mergeHeaders(options?: FetchOptions): FetchOptions | undefined {
    const extra = this.deps.config.additionalHeaders;
    if (!extra) return options;
    return {
      ...options,
      headers: {
        ...extra,
        ...(options?.headers as Record<string, string> | undefined),
      },
    };
  }

  protected async getRequest<TResponseData>(args: Omit<GetRequestArgs<TResponseData>, "apiKey">) {
    return baseGetRequest({
      ...args,
      options: this.mergeHeaders(args.options),
      apiKey: this.deps.apiKey,
    });
  }

  protected async postRequest<TResponseData>(args: Omit<PostRequestArgs<TResponseData>, "apiKey">) {
    return basePostRequest({
      ...args,
      options: this.mergeHeaders(args.options),
      apiKey: this.deps.apiKey,
    });
  }

  protected async patchRequest<TResponseData>(
    args: Omit<PatchRequestArgs<TResponseData>, "apiKey">,
  ) {
    return basePatchRequest({
      ...args,
      options: this.mergeHeaders(args.options),
      apiKey: this.deps.apiKey,
    });
  }
}
