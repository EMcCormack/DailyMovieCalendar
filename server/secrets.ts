import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
export function createTokenProvider() {
  const client = new SSMClient({});
  let cached: { value: string; expires: number } | undefined;
  return async () => {
    if (cached && cached.expires > Date.now()) return cached.value;
    const name = process.env.TMDB_TOKEN_PARAMETER;
    if (!name) throw new Error("Missing TMDB_TOKEN_PARAMETER");
    const result = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    const value = result.Parameter?.Value;
    if (!value) throw new Error("Empty TMDB token parameter");
    cached = { value, expires: Date.now() + 300000 };
    return value;
  };
}
