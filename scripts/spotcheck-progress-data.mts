import pg from "pg";

const url =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/wanora";
const client = new pg.Client({ connectionString: url });
await client.connect();

const companies = await client.query(
  `select count(*)::int as n, count(nullif(btrim(coalesce(name,'')),''))::int as named from companies`,
);
const apps = await client.query(
  `select count(*)::int as n,
          count(distinct company_id)::int as companies,
          count(*) filter (where outcome is not null)::int as with_outcome
   from applications`,
);
const stages = await client.query(
  `select count(*)::int as n,
          count(*) filter (where status = 'pending')::int as pending,
          count(*) filter (where status = 'passed')::int as passed
   from application_stages`,
);
const interviews = await client.query(
  `select count(*)::int as n from interviews`,
);
const feedback = await client.query(
  `select id, left(coalesce(body,''), 40) as body,
          left(coalesce(question,''), 40) as question,
          left(coalesce(own_answer,''), 40) as own_answer,
          jsonb_array_length(qa_items) as qa_len,
          qa_items
   from interview_feedbacks
   order by created_at
   limit 8`,
);

console.log(
  JSON.stringify(
    {
      companies: companies.rows[0],
      applications: apps.rows[0],
      stages: stages.rows[0],
      interviews: interviews.rows[0],
      feedbackSample: feedback.rows,
    },
    null,
    2,
  ),
);
await client.end();
