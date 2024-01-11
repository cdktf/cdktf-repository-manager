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
