# Generating the zip file for Segger ARM

Suggest the following for generating the zip file:

- Go to Segger Embedded Studio Downloads page
- Download / install the version desired (usually the latest)
- Note the path to the installed SES-ARM
- Create a SES-abridged folder (name as you see fit)
- Copy (recursively) the following files from the SES-ARM folder to the SES-abridged folder
  - bin/segger-{cc,as,ld}
  - gcc/arm-none-eabi
  - include
  - lib
- Add the extra four files to the SES-abridged/lib folder:
  - libc_v6m_t_le_eabi_balanced.a
  - libc_v6m_t_le_eabi_small.a
  - strops_v6m_t_le_eabi_balanced.a
  - strops_v6m_t_le_eabi_small.a
- zip up the SES-abridged folder: `cd SES-abridged && zip -r ../<zipfile name> *`
