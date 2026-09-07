import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
test("deployment keeps Lambda outside a customer VPC and provisions pay-per-request DynamoDB", () => {
  const doc = parseDocument(readFileSync("template.yaml", "utf8"), {
    customTags: ["!Ref", "!Sub", "!GetAtt"].map((tag) => ({
      tag,
      resolve: (value: string) => value,
    })),
  });
  assert.deepEqual(doc.errors, []);
  const template = doc.toJS();
  const resources = template.Resources;
  assert.equal(resources.MovieFunction.Properties.Runtime, "nodejs24.x");
  assert.equal(resources.MovieFunction.Properties.VpcConfig, undefined);
  assert.equal(
    resources.CollectionsTable.Properties.BillingMode,
    "PAY_PER_REQUEST",
  );
  assert.equal(resources.CollectionsTable.DeletionPolicy, "Retain");
  assert.equal(resources.FunctionLogs.Properties.RetentionInDays, 7);
  assert.ok(
    !Object.values(resources).some((r) =>
      (r as { Type: string }).Type.startsWith("AWS::EC2::"),
    ),
  );
  const statements = resources.MovieFunction.Properties.Policies[0].Statement;
  assert.deepEqual(statements.map((s: { Action: string }) => s.Action).sort(), [
    "dynamodb:Query",
    "ssm:GetParameter",
  ]);
  assert.ok(
    !JSON.stringify(resources.MovieFunction.Properties.Environment).includes(
      "TMDB_READ_TOKEN",
    ),
  );
});
