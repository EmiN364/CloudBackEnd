import { SNSClient, SubscribeCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export async function subscribeEmailToSns(email: string) {
  const topicArn = process.env.AWS_SNS_TOPIC_ARN;
  if (!topicArn) throw new Error("SNS topic ARN not configured");

  const command = new SubscribeCommand({
    Protocol: "email",
    TopicArn: topicArn,
    Endpoint: email,
  });

  await snsClient.send(command);
}