"""learner extra destinations

Revision ID: a3c51e7d9b20
Revises: cfb9e85dfdb5
Create Date: 2026-11-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a3c51e7d9b20'
down_revision: Union[str, Sequence[str], None] = 'cfb9e85dfdb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('learner_profiles', sa.Column('extra_destinations', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('learner_profiles', 'extra_destinations')
