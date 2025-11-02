/**
 * Configuration for AWS Systems Manager Parameter Store.
 */
export const SSMConfig = {
    /** The AWS region where SSM parameters are stored. */
    Region: "eu-west-3",
    /** The parameter name/path where SNCF user data is stored. */
    UsersParameterName: "/SNCFMaxJeune/users",
};
