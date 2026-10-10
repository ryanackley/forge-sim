/**
 * Full fetch-Response implementations for the @forge/* shims.
 *
 * Real @forge/api types requestJira/asApp()/asUser() results as APIResponse =
 * Response, and real @forge/bridge types its product requests as
 * Promise<Response> — so apps legitimately call clone(), arrayBuffer(), read
 * .url, etc. The simulator's internal ProductApiResponse is deliberately
 * smaller (user-written mock routes implement it), so the shims wrap it in
 * this class at the boundary.
 *
 * Body is single-read like a real Response: a second json()/text() throws
 * exactly as it would in Forge.
 */

// Derived from the global fetch types so this compiles against whichever lib
// (undici via @types/node, or DOM) the including compilation uses
type ResponseTypeValue = Response['type'];
export type HeadersSource = ConstructorParameters<typeof Headers>[0];

export abstract class BaseFetchResponse implements Response {
  public readonly ok: boolean;
  public readonly status: number;
  public readonly statusText: string;
  public readonly headers: Headers;
  public readonly redirected = false;
  public readonly type: ResponseTypeValue = 'basic';
  public readonly url = '';
  public bodyUsed = false;

  constructor(status: number, statusText: string, headers: HeadersSource) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.statusText = statusText;
    this.headers = new Headers(headers);
  }

  /**
   * Real Response.body is a ReadableStream. The simulator holds parsed
   * bodies, so this reports null (the shape of a bodyless response) — read
   * via json()/text()/arrayBuffer() instead. Typed via the global Response so
   * the stream brand matches whichever lib (undici vs DOM) is compiling.
   */
  get body(): Response['body'] {
    return null;
  }

  /** Read the body as text, without consume tracking. */
  protected abstract readText(): Promise<string>;
  /** Read the body as parsed JSON, without consume tracking. */
  protected abstract readJson(): Promise<any>;
  abstract clone(): Response;

  protected consume(): void {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed.');
    }
    this.bodyUsed = true;
  }

  async json(): Promise<any> {
    this.consume();
    return this.readJson();
  }

  async text(): Promise<string> {
    this.consume();
    return this.readText();
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    this.consume();
    return new TextEncoder().encode(await this.readText());
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    this.consume();
    return new TextEncoder().encode(await this.readText()).buffer as ArrayBuffer;
  }

  async blob(): Promise<Blob> {
    this.consume();
    return new Blob([await this.readText()], {
      type: this.headers.get('content-type') ?? 'application/json',
    });
  }

  async formData(): Promise<FormData> {
    this.consume();
    // Same error a real Response throws for a non-form content type
    throw new TypeError('Could not parse content as FormData.');
  }
}

/** Response over an already-materialized body value (string or JSON value). */
export class ValueFetchResponse extends BaseFetchResponse {
  private readonly _bodyValue: any;

  constructor(body: any, status = 200, statusText?: string, headers: HeadersSource = { 'content-type': 'application/json' }) {
    super(status, statusText ?? (status >= 200 && status < 300 ? 'OK' : 'Error'), headers);
    this._bodyValue = body;
  }

  protected async readText(): Promise<string> {
    return typeof this._bodyValue === 'string' ? this._bodyValue : JSON.stringify(this._bodyValue);
  }

  protected async readJson(): Promise<any> {
    return typeof this._bodyValue === 'string' ? JSON.parse(this._bodyValue) : this._bodyValue;
  }

  clone(): Response {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed.');
    }
    return new ValueFetchResponse(this._bodyValue, this.status, this.statusText, this.headers);
  }
}

/** The subset of the sim's ProductApiResponse this wrapper reads from. */
export interface ProductApiResponseLike {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

/** Response delegating to a simulator ProductApiResponse (lazy body thunks). */
export class ProductFetchResponse extends BaseFetchResponse {
  private readonly inner: ProductApiResponseLike;

  constructor(inner: ProductApiResponseLike) {
    super(inner.status, inner.statusText, inner.headers);
    this.inner = inner;
  }

  protected readText(): Promise<string> {
    return this.inner.text();
  }

  protected readJson(): Promise<any> {
    return this.inner.json();
  }

  clone(): Response {
    if (this.bodyUsed) {
      throw new TypeError('Body has already been consumed.');
    }
    return new ProductFetchResponse(this.inner);
  }
}
