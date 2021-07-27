import fs from "fs";
import path from "path";
import dayjs from "dayjs"
import { S3 } from "aws-sdk";

import chromium from "chrome-aws-lambda";

import { document } from "../utils/dynamodbClient";
import handlebars from "handlebars";
import { APIGatewayProxyHandler } from "aws-lambda";

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

const compile = function (data: ITemplate) {
  const filePath = path.join(process.cwd(), "src", "templates", "certificate.hbs");
  const html = fs.readFileSync(filePath, "utf-8");
  const compile = handlebars.compile(html);

  return compile(data);
}

export const handle: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

  const response = await document.query({
    TableName: "users_certificates",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise()

  const [userAlreadyExists] = response.Items;

  if (userAlreadyExists) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Certificate Valid",
        name: userAlreadyExists.name,
        grade: userAlreadyExists.grade,
        url: `https://serverlesscertificateaws.s3.amazonaws.com/${userAlreadyExists.id}.pdf`
      })
    }
  }

    await document.put({
      TableName: "users_certificates",
      Item: {
        id,
        name,
        grade,
      },
    }).promise();

  const medalPath = path.join(process.cwd(), "src", "templates", "seal.png");
  const medal = fs.readFileSync(medalPath, "base64");

  const data: ITemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade,
    name,
    id,
    medal
  }

  const content = compile(data);

  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath
  });

  const page = await browser.newPage();
  await page.setContent(content);

  const pdf = await page.pdf({
    format: "a4",
    landscape: true,
    path: process.env.IS_OFFLINE ? "certificate.pdf" : null,
    printBackground: true,
    preferCSSPageSize: true
  });

  await browser.close();

  const s3 = new S3();
  await s3.putObject({
    Bucket: "serverlesscertificateaws",
    Key: `${id}.pdf`,
    ACL: "public-read",
    Body: pdf,
    ContentType: "application/pdf"
  }).promise()

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "Certificate created!",
      url: `https://serverlesscertificateaws.s3.amazonaws.com/${id}.pdf`
    }),
    headers: {
      "Content-type": "application/json"
    }
  }
}