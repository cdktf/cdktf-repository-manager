# The Future of Terraform CDK

## Sunset Notice

Terraform CDK (CDKTF) will sunset and be archived on December 10, 2025. HashiCorp, an IBM Company, will no longer maintain or develop the project after that date. Unfortunately, Terraform CDK did not find product-market fit at scale. HashiCorp, an IBM Company, has chosen to focus its investments on Terraform core and its broader ecosystem.

As of December 10, 2025, Terraform CDK will be archived on GitHub, and the documentation will reflect its deprecated status. The archived code will remain available on GitHub, but it will be read-only. No further updates, fixes, or improvements (including compatibility updates) will be made.

You will be able to continue to use Terraform CDK at your own risk. Terraform CDK is licensed under the Mozilla Public License (MPL). HashiCorp, an IBM Company, does not apply any additional restrictions. We encourage community forks if there’s interest in continuing development independently.

## Migration to HCL

You can use the following command to generate Terraform-compatible .tf files directly from your Terraform CDK project:

`cdktf synth --hcl`

This will produce readable HCL configuration files, making it easier to migrate away from Terraform CDK. After running the command, you can use standard Terraform CLI commands (`terraform init`, `terraform plan`, `terraform apply`) to continue managing your infrastructure. Please note that while this helps bootstrap your configuration, you may still need to review and adjust the generated files for clarity, organization, or best practices.

### Note on AWS CDK

If your infrastructure is defined in Terraform CDK but also tightly integrated with AWS CDK, you may find it more consistent to migrate directly to the AWS CDK ecosystem. If you are not using AWS CDK, we highly recommend migrating to standard Terraform and HCL for long-term support and ecosystem alignment.

## FAQ

Q: Is CDKTF still being developed?

A: No. CDKTF will sunset and be archived on December 10, 2025. HashiCorp, an IBM Company, will no longer maintain or develop the project after that date.

Q: Why is CDKTF being sunset?

A: CDKTF did not find product-market fit at scale. We’ve chosen to focus our investments on Terraform core and its broader ecosystem.

Q: Will CDKTF be removed from GitHub?

A: CDKTF will be archived on GitHub, and documentation will reflect its deprecated status.

Q: Can I still use CDKTF after it's sunset?

A: Yes, the archived code will remain available on GitHub, but it will be read-only. No further updates, fixes, or improvements will be made.

Q: Will CDKTF continue to support new versions of Terraform or providers?

A: No. Compatibility updates will not be made after the EOL date.

Q: Can I fork CDKTF and maintain it myself?

A: Yes. CDKTF is open source, and we encourage community forks if there’s interest in continuing development independently.

Q: Can I keep using CDKTF?

A: You may continue to use it at your own risk. HashiCorp, an IBM Company, will no longer be maintaining it.

Q: Is there a migration tool?

A: You can use the following command to generate Terraform-compatible .tf files directly from your CDKTF project:

`cdktf synth --hcl`

This will produce readable HCL configuration files, making it easier to migrate away from CDKTF. After running the command, you can use standard Terraform CLI commands (terraform init, terraform plan, terraform apply) to continue managing your infrastructure. Please note that while this helps bootstrap your configuration, you may still need to review and adjust the generated files for clarity, organization, or best practices.

Q: What migration guidance can we provide to customers?

A: For users looking to migrate away from CDKTF:

If your infrastructure is defined in CDKTF but also tightly integrated with AWS CDK, you may find it more consistent to migrate directly to the AWS CDK ecosystem.

If you are not using AWS CDK, we highly recommend migrating to standard Terraform and HCL for long-term support and ecosystem alignment.

---

# repository-manager

## About

This project handles repository management for the prebuilt Terraform provider packages and custom constructs that are published for use with [Cloud Development Kit for Terraform (CDKTF)](https://github.com/hashicorp/terraform-cdk).

CDKTF allows you to use familiar programming languages to define cloud infrastructure and provision it through HashiCorp Terraform. This gives you access to the entire Terraform ecosystem without learning HashiCorp Configuration Language (HCL). Terraform providers can be generated locally to be used with your application, or installed via one of the prebuilt packages. We currently publish and maintain a small subset of prebuilt packages for the Terraform providers that currently have the highest usage in CDKTF apps. The current list of prebuilt provider packages can be found [here](https://github.com/hashicorp/cdktf-repository-manager/blob/main/provider.json).

## How we decide which providers to publish prebuilt packages for

Our current policy is as follows:

- We publish & maintain prebuilt packages for all providers labeled "[Official](https://registry.terraform.io/browse/providers?tier=official)" in the Terraform Registry, except those that have been deprecated/retired by HashiCorp
- We publish & maintain prebuilt packages for any providers labeled "[Partner](https://registry.terraform.io/browse/providers?tier=partner)" in the Terraform Registry _only_ upon explicit request by the technology partner (see below)
- We will not publish & maintain prebuilt packages for any providers labeled "[Community](https://registry.terraform.io/browse/providers?tier=community)" in the Terraform Registry, except for those providers that had already been onboarded onto our system before we instituted this policy

### Information for HashiCorp Partners

We are currently prioritizing publishing a small subset of prebuilt provider packages, based on usage in existing CDKTF applications. If you are a current partner and you are interested in having a prebuilt package made available for your provider, please email [technologypartners@hashicorp.com](mailto:technologypartners@hashicorp.com) and also file an issue [here](https://github.com/cdktf/cdktf-repository-manager/issues/new?assignees=&labels=new+provider+request&projects=&template=request-provider.yml&title=New+Pre-built+Provider+Request%3A+PROVIDER_NAME).
