import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "src/utils/dynamodbClient";

export const handle: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const response = await document.query({
    TableName: "users_certificates",
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: {
      ":id": id
    }
  }).promise()

  const [userCertificate] = response.Items;

  if (userCertificate) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Certificate Valid",
        name: userCertificate.name,
        grade: userCertificate.grade,
        url: `https://serverlesscertificateaws.s3.amazonaws.com/${userCertificate.id}.pdf`
      })
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: "Certificate invalid",
    })
  }
}