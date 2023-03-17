import { readFile } from 'node:fs/promises'
import * as core from '@actions/core'
import glob from 'glob'
import { fromZodError } from 'zod-validation-error'
import { validate } from '@deconz-community/ddf-validator'
import { ZodError } from 'zod'

async function run(): Promise<void> {
  try {
    const inputDirectory = `${core.getInput('directory')}/${core.getInput('search')}`

    core.info(`Looking for files in ${inputDirectory}`)

    const inputFiles = await glob(inputDirectory, {
      ignore: core.getInput('ignore'),
    })

    if (inputFiles.length === 0)
      throw new Error('No files found. Please check the settings.')

    core.info(`Found ${inputFiles.length} files to valiate.`)

    let errorCount = 0
    for (const file of inputFiles) {
      const data = await readFile(file, 'utf-8')
      const decoded = JSON.parse(data)
      try {
        validate(decoded)
      }
      catch (error) {
        errorCount++
        if (error instanceof ZodError)
          core.error(`${file}:${fromZodError(error).message}`)
        else if (error instanceof Error)
          core.error(error.message)
        else
          core.error('Unknown Error')
      }
    }

    if (errorCount > 0)
      core.setFailed(`Found ${errorCount} invalid files. Check logs for details.`)
    else
      core.info('All files passed.')
  }
  catch (error) {
    if (error instanceof Error)
      core.setFailed(error.message)
  }
}

run()
