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

  protected async getRequest<TResponseData>(args: Omit<GetRequestArgs<TResponseData>, "apiKey">) {
    return baseGetRequest({
      ...args,
      apiKey: this.deps.apiKey,
    });
  }

  protected async postRequest<TResponseData>(args: Omit<PostRequestArgs<TResponseData>, "apiKey">) {
    return basePostRequest({
      ...args,
      apiKey: this.deps.apiKey,
    });
  }

  protected async patchRequest<TResponseData>(
    args: Omit<PatchRequestArgs<TResponseData>, "apiKey">,
  ) {
    return basePatchRequest({
      ...args,
      apiKey: this.deps.apiKey,
    });
  }
}
