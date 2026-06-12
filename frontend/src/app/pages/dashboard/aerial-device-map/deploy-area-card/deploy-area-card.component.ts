import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { DeployEditAction } from '../../../../models/deploy-area.model';

@Component({
  selector: 'app-deploy-area-card',
  imports: [TooltipModule],
  templateUrl: './deploy-area-card.component.html',
  styleUrl: './deploy-area-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeployAreaCardComponent {
  @Input() activeAction: DeployEditAction | null = null;

  @Output() deleteArea = new EventEmitter<void>();
  @Output() moveArea = new EventEmitter<void>();
  @Output() resizeArea = new EventEmitter<void>();
  @Output() reshapeArea = new EventEmitter<void>();
  @Output() closeArea = new EventEmitter<void>();
}
