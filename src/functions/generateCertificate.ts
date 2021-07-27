import fs from "fs";
import path from "path";
import dayjs from "dayjs"

import chromium from "chrome-aws-lambda";

import { document } from "../utils/dynamodbClient";
import handlebars from "handlebars";

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate {
  id: string;
  name: string;
  grade: string;
  date: string;
  medal: string;
}

const compile = function(data: ITemplate) {
  const filePath = path.join(process.cwd() + "src", "templates", "certificate.hbs");
  const html = fs.readFileSync(filePath, "utf-8");
  const compile = handlebars.compile(html);
  
  return compile(data);
}

export const handle = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;


  await document.put({
    TableName: "users_certificates",
    Item: {
      id,
      name,
      grade,
    },
  }).promise();

  const medalPath = path.join(process.cwd() + "src", "templates", "seal.png");
  const medal = fs.readFileSync(medalPath, "base64");

  const data: ITemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade, 
    name,
    id,
    medal
  }

  const content = compile(data);

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificate created!"
    }),
    headers: {
      "Content-type": "application/json"
    }
  }
}