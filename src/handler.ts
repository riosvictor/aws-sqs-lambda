import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Callback, Context, ProxyResult, S3Event } from 'aws-lambda';
import { streamToString } from './utils';
import { Stream } from 'stream';

const client = new S3Client({
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
  endpoint: process.env.AWS_S3_HOST as string,
});

export const execute = async (event: S3Event, context: Context, callback: Callback): Promise<ProxyResult> => {
  const s3Record = event.Records[0].s3;
  const bucketName = s3Record.bucket.name;
  const objectKey = s3Record.object.key;

  console.log(`New object created in bucket ${bucketName} with key ${objectKey}`);

  try {
    const input = {
      Bucket: bucketName,
      Key: objectKey,
    };
    const command = new GetObjectCommand(input);
    const response = await client.send(command);
    const stream = response.Body as Stream;

    const fileContent = await streamToString(stream);
    const fileContentJSON = JSON.parse(fileContent);
    console.log('Conteúdo do arquivo:', JSON.stringify(fileContentJSON, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed object ${objectKey} from bucket ${bucketName}`,
        content: fileContent,
      }),
    };
  } catch (error) {
    console.error('Erro ao ler o objeto do S3:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Erro ao processar o objeto S3',
        error: error.message,
      }),
    };
  }
}
