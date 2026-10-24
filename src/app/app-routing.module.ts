import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { OnboardingGuard, VaultLockedGuard, VaultUnlockedGuard } from './core/auth/vault.guard';

const routes: Routes = [
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [OnboardingGuard]
  },
  {
    path: 'unlock',
    loadComponent: () => import('./features/unlock/unlock.component').then(m => m.UnlockComponent),
    canActivate: [VaultLockedGuard]
  },
  {
    path: 'credentials',
    loadComponent: () => import('./features/credentials/credential-list.component').then(m => m.CredentialListComponent),
    canActivate: [VaultUnlockedGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [VaultUnlockedGuard]
  },
  {
    path: '',
    redirectTo: 'credentials',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'credentials'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
