import AWS from 'aws-sdk';
import { SSMConfig } from './config';

/**
 * AWS SSM client instance configured for the project's region.
 */
const ssm = new AWS.SSM({
  region: SSMConfig.Region,
});

export default ssm;