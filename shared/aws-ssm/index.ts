import AWS from 'aws-sdk';
import { SSMConfig } from './config';

const ssm = new AWS.SSM({
  region: SSMConfig.Region,
});

export default ssm;