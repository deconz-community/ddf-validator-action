import { readFile } from 'node:fs/promises'
import * as core from '@actions/core'
import glob from 'glob'
import { fromZodError } from 'zod-validation-error'
import { createValidator } from '@deconz-community/ddf-validator'
import { ZodError } from 'zod'

async function run(): Promise<void> {
  try {
    const validator = createValidator()

    // Load generic files
    let genericErrorCount = 0
    const genericDirectory = core.getInput('generic')
      ? `${core.getInput('generic')}/${core.getInput('search')}`
      : `${core.getInput('directory')}/generic/${core.getInput('search')}`

    core.info(`Loading generic files from ${genericDirectory}`)

    const genericFiles = await glob(genericDirectory)

    if (genericFiles.length === 0)
      throw new Error('No generic files found. Please check the settings.')

    for (const file of genericFiles) {
      try {
        const data = await readFile(file, 'utf-8')
        const decoded = JSON.parse(data)
        validator.loadGeneric(decoded)
      }
      catch (error) {
        genericErrorCount++
        if (error instanceof ZodError)
          core.error(`${file}:${fromZodError(error).message}`)
        else if (error instanceof Error)
          core.error(error.message)
        else
          core.error('Unknown Error')
      }
    }

    core.info(`Loaded ${genericFiles.length - genericErrorCount} files.`)
    if(genericErrorCount > 0){
      core.warning(`${genericErrorCount} files was not loaded because of errors.`)
    }
    
    // Validate DDF files
    let ddfErrorCount = 0
    const ddfDirectory = `${core.getInput('directory')}/${core.getInput('search')}`

    core.info(`Validating DDF files from ${ddfDirectory} (ignore: ${core.getInput('ignore')})`)

    const inputFiles = await glob(ddfDirectory, {
      ignore: core.getInput('ignore'),
    })

    if (inputFiles.length === 0)
      throw new Error('No files found. Please check the settings.')

    core.info(`Found ${inputFiles.length} files to valiate.`)

    for (const file of inputFiles) {
      try {
        const data = await readFile(file, 'utf-8')
        const decoded = JSON.parse(data)
        validator.validate(decoded)
      }
      catch (error) {
        ddfErrorCount++
        if (error instanceof ZodError)
          core.error(`${file}:${fromZodError(error).message}`)
        else if (error instanceof Error)
          core.error(error.message)
        else
          core.error('Unknown Error')
      }
    }

    if ((genericErrorCount + ddfErrorCount) > 0)
      core.setFailed(`Found ${genericErrorCount + ddfErrorCount} invalid files. Check logs for details.`)
    else
      core.info('All files passed.')
  }
  catch (error) {
    if (error instanceof Error)
      core.setFailed(error.message)
  }
}

run()
