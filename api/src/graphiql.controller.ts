import { Controller, Get, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";

const graphiqlHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Budget Base GraphiQL</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3.8.3/graphiql.min.css" />
  <style>
    body {
      margin: 0;
      overflow: hidden;
    }

    #main {
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="main"></div>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql@3.8.3/graphiql.min.js"></script>
  <script>
    const fetcher = async (graphQLParams) => {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(graphQLParams)
      });

      return response.json();
    };

    ReactDOM.render(
      React.createElement(GraphiQL, {
        fetcher,
        headerEditorEnabled: true,
        shouldPersistHeaders: true,
        defaultQuery: [
          "query BudgetOverview {",
          "  budget {",
          "    id",
          "    name",
          "    currency",
          "    months {",
          "      id",
          "      name",
          "      startingBalance",
          "    }",
          "  }",
          "}"
        ].join("\\n")
      }),
      document.getElementById("main")
    );
  </script>
</body>
</html>`;

@Controller("graphiql")
export class GraphiqlController {
  @Get()
  getGraphiql(@Res() reply: FastifyReply) {
    return reply.type("text/html").send(graphiqlHtml);
  }
}
