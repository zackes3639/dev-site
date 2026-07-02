import { SendEmailCommand, SESv2Client, type SendEmailCommandInput } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});

export interface SendNewsletterEmailParams {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  replyToEmail?: string;
}

export interface SendNewsletterEmailResult {
  messageId?: string;
}

export class NewsletterEmailSender {
  async send(params: SendNewsletterEmailParams): Promise<SendNewsletterEmailResult> {
    const input: SendEmailCommandInput = {
      FromEmailAddress: params.fromEmail,
      Destination: {
        ToAddresses: [params.toEmail]
      },
      Content: {
        Simple: {
          Subject: {
            Data: params.subject,
            Charset: "UTF-8"
          },
          Body: {
            Text: {
              Data: params.body,
              Charset: "UTF-8"
            }
          }
        }
      }
    };

    if (params.replyToEmail) {
      input.ReplyToAddresses = [params.replyToEmail];
    }

    const result = await ses.send(new SendEmailCommand(input));
    return result.MessageId ? { messageId: result.MessageId } : {};
  }
}
