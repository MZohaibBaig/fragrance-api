import { test, expect, type APIRequestContext } from '@playwright/test'

const API_BASE_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000/api'

async function registerThrowawayUser(request: APIRequestContext): Promise<{ username: string; password: string }> {
  const username = `e2e_${Date.now()}`
  const password = 'correct-horse-battery-staple-42'
  const response = await request.post(`${API_BASE_URL}/register/`, {
    data: { username, password },
  })
  expect(response.ok(), `register failed: ${response.status()} ${await response.text()}`).toBeTruthy()
  return { username, password }
}

test('create ingredient, recipe, batch, and note end to end', async ({ page, request }) => {
  const { username, password } = await registerThrowawayUser(request)

  // No registration UI exists yet, so the throwaway user above is created
  // directly against the API and then signed in through the login page.
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')

  const ingredientName = `Bergamot ${Date.now()}`
  await page.goto('/ingredients')
  await page.getByRole('button', { name: 'New ingredient' }).click()
  await page.locator('#ing-name').fill(ingredientName)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: ingredientName, exact: true })).toBeVisible()

  const recipeName = `Test Recipe ${Date.now()}`
  await page.goto('/recipes')
  await page.getByRole('button', { name: 'New recipe' }).click()
  await page.locator('#recipe-name').fill(recipeName)
  await page.locator('#recipe-concentration').fill('22')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/recipes\/\d+/)

  await page.locator('#ri-ingredient').selectOption({ label: ingredientName })
  await page.locator('#ri-proportion').fill('100')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText(ingredientName)).toBeVisible()

  await page.goto('/batches/new')
  await page.locator('#batch-recipe').selectOption({ label: recipeName })
  await page.locator('#batch-size').fill('40')
  await page.locator('#batch-concentration').fill('22')
  await page.getByRole('button', { name: 'Create batch' }).click()
  await expect(page).toHaveURL(/\/batches$/)
  await page.getByText(recipeName).click()
  await expect(page).toHaveURL(/\/batches\/\d+/)

  // 40g @ 22% => 8.80g aromatic, 31.20g diluent (frozen by backend Batch.compute(),
  // displayed with 2 decimal places).
  await expect(page.getByText('8.80g', { exact: true })).toBeVisible()
  await expect(page.getByText('31.20g', { exact: true })).toBeVisible()

  const noteBody = `First note ${Date.now()}`
  await page.locator('#note-body').fill(noteBody)
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByText(noteBody)).toBeVisible()
  await expect(page.getByText(/^Day 0 —/)).toBeVisible()
})
